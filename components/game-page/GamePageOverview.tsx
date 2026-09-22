"use client";

import { Gamepad2 } from "lucide-react";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { CircuitSprintFallbackArt } from "./CircuitSprintFallbackArt";
import { GamePagePanel } from "./GamePageChrome";
import { GamePageContests } from "./GamePageContests";
import { GamePageFeatured } from "./GamePageFeatured";
import { GamePageHowItWorks } from "./GamePageHowItWorks";
import { GamePageInfoSidebar } from "./GamePageInfoSidebar";
import { GamePageTips } from "./GamePageTips";

export function GamePageOverview({ game }: { game: GamePageData }) {
  const useCircuitArt =
    game.slug === "circuit-sprint" ||
    game.categorySlug === "puzzle" ||
    game.categorySlug === "circuit";
  const marketingUrl =
    game.gameplayPreviewUrl || (game.gallery ?? [])[0]?.url;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          <GamePagePanel>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--gp-accent)]">
              About {game.title}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--gp-muted)] md:text-[16px]">
              {game.description ||
                game.tagline ||
                "Details for this game will appear here once an operator adds them."}
            </p>
            {(game.descriptionTags ?? []).length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {(game.descriptionTags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-[var(--gp-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--gp-text)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </GamePagePanel>

          <GamePagePanel className="overflow-hidden p-0">
            <div className="relative aspect-[16/10] bg-black/50 sm:aspect-video">
              {marketingUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={marketingUrl}
                  alt={`${game.title} preview`}
                  className="h-full w-full object-cover"
                />
              ) : useCircuitArt ? (
                <CircuitSprintFallbackArt />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--gp-muted)]">
                  <Gamepad2 className="h-16 w-16 opacity-40" />
                </div>
              )}
            </div>
            {game.gameplayVideoUrl ? (
              <div className="border-t border-[var(--gp-border)] px-5 py-3">
                <a
                  href={game.gameplayVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] font-semibold text-[var(--gp-accent)] hover:underline"
                >
                  Watch gameplay
                </a>
              </div>
            ) : null}
          </GamePagePanel>
        </div>

        <GamePageInfoSidebar game={game} />
      </div>

      <GamePageHowItWorks game={game} />
      <GamePageContests game={game} />
      <GamePageTips game={game} />
      <GamePageFeatured game={game} />
    </div>
  );
}
